import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings , ChatOpenAI } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { text } from "./text.js";
import dotenv from 'dotenv';
dotenv.config();


const pinecone = new Pinecone({
  apiKey:
    process.env.PINECONE_API_KEY
});

const index = pinecone.index("rag-chatbot");

const createChunks = async () => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const chunks = await splitter.createDocuments([text]);
  return chunks;
};

const createEmbeddings = async (texts) => {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey:
      process.env.OPENAI_API_KEY
  });
  return await embeddings.embedDocuments(texts);
};

const storeInVectorDb = async (chunks, vectors) => {
  const indexName = "rag-chatbot";
  const index = pinecone.Index(indexName);
  const batchSize = 100;
  const responses = [];
  try {
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
        id: chunk.id,
        values: vectors[i + j],
        metadata: {
          ...chunk.metadata,
          chunkText: chunk.text,
        },
      }));

      const response = await index.upsert(batch);

      responses.push(
        response ?? { batchStart: i, upsertedCount: batch.length }
      );
    }

    return responses;
  } catch (error) {
    console.log(error);
  }
};

const updateChat = async (req, res) => {
  try {
    const allChunks = [];
    const chunks = await createChunks();
    const documentId = `${Date.now()}`;

    chunks.forEach((doc) => {
      allChunks.push({
        id: `${documentId}_chunk_${allChunks.length}`,
        text: doc.pageContent,
        chunkIndex: allChunks.length,
      });
    });

    const vectors = await createEmbeddings(
      allChunks.map((chunk) => chunk.text)
    );
    const storage = await storeInVectorDb(allChunks, vectors);

    res.status(200).json({
      message: "Success",
      chunkCount: allChunks.length,
    });
  } catch (error) {
    console.error("Error creating chunks:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const chat = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ message: "Missing question in request." });
    }

    // Step 1: Embed the question
    const embedder = new OpenAIEmbeddings({
      openAIApiKey:
        process.env.OPENAI_API_KEY
    });
    const queryEmbedding = await embedder.embedQuery(query);

    // Step 2: Query Pinecone for similar chunks
    const searchResult = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    const matchedChunks = searchResult.matches || [];

    if (matchedChunks.length === 0) {
      return res.status(200).json({
        answer:
          "Sorry, I couldn't find any relevant context to answer your question.",
      });
    }

    const context = matchedChunks
      .map((match) => match.metadata?.chunkText || "")
      .join("\n\n");

      // Step 3: Build prompt
    const prompt = `You are a helpful and accurate assistant. Use only the information provided in the context to answer the user's question as precisely and factually as possible.

    If the context contains multiple jobs or timeframes, prioritize the most recent position based on the latest dates mentioned. Do not include outdated or superseded roles unless specifically asked.
    
    Context:
    ${context}
    
    Question:
    ${query}
    
    If the answer is not available in the context, respond with "The information is not available in the provided context.`;

    // Step 4: Get answer from OpenAI
    const chatModel = new ChatOpenAI({
      openAIApiKey:
        process.env.OPENAI_API_KEY,
      temperature: 0.2,
      modelName: "gpt-3.5-turbo",
    });

    const result = await chatModel.invoke([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ]);

    // Step 5: Send response
    res.status(200).json({ answer: result.content });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { updateChat, chat };

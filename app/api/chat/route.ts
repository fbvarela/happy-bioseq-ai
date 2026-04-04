import { NextRequest } from "next/server";
import { streamChatAI } from "@/lib/ai";
import { getAnalysis, getChatHistory, saveChatMessage } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { analysisId, message } = await req.json();

    if (!analysisId || !message) {
      return new Response(JSON.stringify({ error: "analysisId and message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return new Response(JSON.stringify({ error: "Analysis not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const history = await getChatHistory(analysisId);

    // Save user message (non-blocking)
    saveChatMessage(analysisId, "user", message).catch(console.error);

    // Stream response
    const encoder = new TextEncoder();
    let assistantResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChatAI(
            analysis.rawSequence,
            analysis.bioAnalysis,
            analysis.aiAnnotation,
            history,
            message
          )) {
            assistantResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          // Save assistant response after streaming completes
          saveChatMessage(analysisId, "assistant", assistantResponse).catch(console.error);
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

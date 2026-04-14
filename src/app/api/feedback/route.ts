import { NextRequest, NextResponse } from "next/server";

interface FeedbackEntry {
  id: string;
  text: string;
  image: string | null;
  createdAt: string;
  userAgent: string;
  page: string;
}

const MAX_ENTRIES = 500;
const MAX_TEXT_LENGTH = 2000;
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

const feedbackStore: FeedbackEntry[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, image, page } = body as {
      text?: string;
      image?: string;
      page?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Feedback text is required." },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Feedback text must be under ${MAX_TEXT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (image && typeof image === "string") {
      // Estimate base64 size: base64 is ~4/3 of original binary size
      const sizeEstimate = Math.ceil((image.length * 3) / 4);
      if (sizeEstimate > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: "Image must be under 500KB." },
          { status: 400 }
        );
      }
    }

    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      image: image && typeof image === "string" ? image : null,
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") || "unknown",
      page: typeof page === "string" ? page : "/",
    };

    feedbackStore.unshift(entry);

    // Trim to max entries
    if (feedbackStore.length > MAX_ENTRIES) {
      feedbackStore.length = MAX_ENTRIES;
    }

    return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ feedback: feedbackStore });
}

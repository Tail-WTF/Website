import type { NextApiRequest, NextApiResponse } from "next";
import { sanitizeLinkInText } from "../../utils/sanitizer";

type ResponseData =
  | {
      text: string;
      sanitizedURLs: string[];
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  const { text = null } = req.query;
  if (!text || Array.isArray(text)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const sanitized = await sanitizeLinkInText(text, 3);
  res.status(200).json({
    text: sanitized.text,
    sanitizedURLs: sanitized.links,
  });
}

import mongoose, { Document, Schema } from "mongoose";

export interface Concept extends Document {
  name: string;
  slug: string;
  description: string;
  category: "fundamentals" | "intermediate" | "advanced" | "algorithms";
  language: "typescript" | "javascript" | "php" | "go" | "all" | "agnostic"; // Added PHP, Go, and agnostic as language options
  order: number;
  dependencies?: string[]; // concepts that should be learned first
  resources: {
    title: string;
    url: string;
    type: "article" | "video" | "documentation" | "repository" | "tutorial" | "tool";
  }[];
}

const ConceptSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["fundamentals", "intermediate", "advanced", "algorithms"],
      required: true,
    },
    language: {
      type: String,
      enum: ["typescript", "javascript", "php", "go", "all", "agnostic"], // Added PHP, Go, and agnostic to enum
      required: true,
    },
    order: { type: Number, required: true },
    dependencies: [String],
    resources: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        type: {
          type: String,
          enum: ["article", "video", "documentation", "repository", "tutorial", "tool"],
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

export const ConceptModel = mongoose.model<Concept>("Concept", ConceptSchema);

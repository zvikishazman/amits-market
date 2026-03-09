"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function CreateQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addOption() {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filteredOptions = options.filter((o) => o.trim());
    if (!title.trim() || filteredOptions.length < 2) {
      setError("Please provide a question and at least 2 options.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          options: filteredOptions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create market");
      }

      const data = await res.json();
      router.push(`/dashboard/groups/${groupId}/questions/${data.question.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Create a Market</h1>
        <p className="text-gray-400 mt-1">Set a question and let your group predict the outcome.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass p-6 space-y-6">
        {/* Question */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
            Question
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Who will win the Super Bowl?"
            className="input-field"
            maxLength={200}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            Description <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context or rules for this market..."
            className="input-field min-h-[80px] resize-none"
            maxLength={500}
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Answer Options
          </label>
          <div className="space-y-3">
            {options.map((option, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-8 h-12 flex items-center justify-center text-sm font-mono text-gray-500">
                  {i + 1}.
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="input-field flex-1"
                  maxLength={100}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="px-3 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              + Add option
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Market"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

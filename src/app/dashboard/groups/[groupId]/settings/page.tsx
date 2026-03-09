"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface GroupInfo {
  id: string;
  name: string;
  inviteCode: string;
  creator: { name: string };
}

export default function GroupSettingsPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const fetchGroup = useCallback(() => {
    fetch(`/api/groups/${groupId}`)
      .then((r) => r.json())
      .then((data) => setGroup(data.group))
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  function copyToClipboard(text: string, type: "link" | "code") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!group) {
    return <div className="animate-pulse"><div className="h-8 bg-gray-800 rounded w-1/3" /></div>;
  }

  const inviteLink = `${window.location.origin}/join/${group.inviteCode}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <Link href={`/dashboard/groups/${groupId}`} className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Back to {group.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">Group Settings</h1>
      </div>

      {/* Invite section */}
      <div className="glass p-6 space-y-4">
        <h2 className="font-semibold text-lg">Invite Friends</h2>
        <p className="text-sm text-gray-400">Share the link or code below to invite friends to your group.</p>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Invite Link</label>
          <div className="flex gap-2 mt-1">
            <input type="text" readOnly value={inviteLink} className="input-field flex-1 text-sm font-mono" />
            <button
              onClick={() => copyToClipboard(inviteLink, "link")}
              className="btn-primary !px-4 text-sm whitespace-nowrap"
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Invite Code</label>
          <div className="flex gap-2 mt-1">
            <div className="input-field flex-1 font-mono text-xl tracking-widest text-blue-400">
              {group.inviteCode}
            </div>
            <button
              onClick={() => copyToClipboard(group.inviteCode, "code")}
              className="btn-secondary !px-4 text-sm"
            >
              {copied === "code" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Group info */}
      <div className="glass p-6 space-y-4">
        <h2 className="font-semibold text-lg">Group Info</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Name</span>
            <span>{group.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Created by</span>
            <span>{group.creator.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

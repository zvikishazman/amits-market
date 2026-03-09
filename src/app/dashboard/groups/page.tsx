"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  _count: { members: number; questions: number };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">My Groups</h1>
        <Link href="/dashboard/groups/new" className="btn-primary text-xs sm:text-sm !py-2 !px-3 sm:!px-4">
          + Create Group
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-2/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="glass p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
          <p className="text-gray-400 mb-6 text-sm">Create a group and invite friends!</p>
          <Link href="/dashboard/groups/new" className="btn-primary">Create Group</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/dashboard/groups/${group.id}`}
              className="glass-hover p-5 sm:p-6 block"
            >
              <h3 className="font-semibold text-white text-base sm:text-lg mb-1">{group.name}</h3>
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                <span>{group._count.members} members</span>
                <span>{group._count.questions} markets</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
                  {group.inviteCode}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

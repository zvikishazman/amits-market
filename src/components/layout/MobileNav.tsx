"use client";

import { useEffect } from "react";
import Sidebar from "./Sidebar";
import { useI18n } from "@/lib/i18n/context";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { dir } = useI18n();
  const isRtl = dir === "rtl";

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const closedTransform = isRtl ? "translateX(100%)" : "translateX(-100%)";
  const panelStyle: React.CSSProperties = {
    transform: isOpen ? "translateX(0)" : closedTransform,
    ...(isRtl ? { right: 0, left: "auto" } : { left: 0, right: "auto" }),
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        className="fixed inset-y-0 z-50 w-64 transition-transform duration-300 ease-out lg:hidden"
        style={panelStyle}
      >
        <Sidebar onClose={onClose} />
      </div>
    </>
  );
}

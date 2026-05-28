import { motion, AnimatePresence } from "motion/react";
import {
  Menu,
  Minimize2,
  X,
  Paperclip,
  Pencil,
  Clipboard,
  Send,
  FileText,
  Download,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { ConversationSidebar } from "./ConversationSidebar";

interface FullChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

export function FullChatOverlay({
  isOpen,
  onClose,
  onMinimize,
}: FullChatOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-white flex flex-col"
        >
          {/* Top Navigation Bar */}
          <div
            className="h-14 flex items-center justify-between px-4 border-b border-[#E5E7EB]"
            style={{
              background: "radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b)",
            }}
          >
            <button
              className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>

            <h1 className="font-bold text-white">Remi Chat</h1>

            <div className="flex items-center gap-2">
              <button
                onClick={onMinimize}
                className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Collapse"
              >
                <Minimize2 className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar - Conversation Dashboard */}
            <ConversationSidebar />

            {/* Center Column - Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Assistant Message */}
                <div className="flex items-start gap-2">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[70%]">
                    <p className="text-sm text-gray-800">
                      Hi, I'm Remi. How can I help you today?
                    </p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex items-start gap-2 justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[70%]">
                    <p className="text-sm text-white">
                      Can you help me with my project planning?
                    </p>
                  </div>
                </div>

                {/* Assistant Message */}
                <div className="flex items-start gap-2">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[70%]">
                    <p className="text-sm text-gray-800">
                      Of course! I'd be happy to help with your project planning.
                      What kind of project are you working on?
                    </p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex items-start gap-2 justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[70%]">
                    <p className="text-sm text-white">
                      I'm building a new web application for my business.
                    </p>
                  </div>
                </div>

                {/* Assistant Message */}
                <div className="flex items-start gap-2">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[70%]">
                    <p className="text-sm text-gray-800">
                      Great! Let's start by breaking down the key features you need.
                      What's the main purpose of this web application?
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex items-center gap-2">
                  {/* Action Icons */}
                  <div className="flex items-center gap-1">
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors"
                      aria-label="Upload"
                    >
                      <Paperclip className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors"
                      aria-label="Copy"
                    >
                      <Clipboard className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  {/* Input Field */}
                  <input
                    type="text"
                    placeholder="Type your message…"
                    className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                  />

                  {/* Send Button */}
                  <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b)",
                    }}
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Uploaded Files */}
            <div className="w-1/4 bg-[#F9FAFB] border-l border-[#E5E7EB] overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="w-4 h-4 text-gray-600" />
                  <h2 className="font-semibold text-gray-800">Uploaded Files</h2>
                </div>

                <div className="space-y-2">
                  {/* PDF File */}
                  <div className="bg-white rounded-lg p-3 border border-[#E5E7EB]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          project-brief.pdf
                        </p>
                        <p className="text-xs text-gray-500">2.4 MB</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                          aria-label="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TXT File */}
                  <div className="bg-white rounded-lg p-3 border border-[#E5E7EB]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          requirements.txt
                        </p>
                        <p className="text-xs text-gray-500">18 KB</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                          aria-label="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* PDF File */}
                  <div className="bg-white rounded-lg p-3 border border-[#E5E7EB]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          design-mockups.pdf
                        </p>
                        <p className="text-xs text-gray-500">5.1 MB</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                          aria-label="Download"
                        >
                          <Download className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from "motion/react";
import { X, Maximize2, Paperclip, Pencil, Clipboard, Send } from "lucide-react";

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onExpand: () => void;
}

export function ChatWidget({ isOpen, onClose, onExpand }: ChatWidgetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 right-5 w-[350px] rounded-2xl bg-white border border-[#E5E7EB] z-40"
          style={{
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* Header */}
          <div
            className="h-12 rounded-t-2xl flex items-center justify-between px-4"
            style={{
              background: "radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b)",
            }}
          >
            <span className="font-bold text-white">Remi</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onExpand}
                className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
                aria-label="Expand"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Chat Area */}
          <div className="h-[300px] bg-white p-4 overflow-y-auto">
            {/* Assistant Message */}
            <div className="flex items-start gap-2 mb-4">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[260px]">
                <p className="text-sm text-gray-800">
                  Hi, I'm Remi. How can I help you today?
                </p>
              </div>
            </div>

            {/* Typing Indicator */}
            <div className="flex items-start gap-2">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: 0,
                  }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: 0.2,
                  }}
                />
                <motion.div
                  className="w-2 h-2 bg-gray-400 rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: 0.4,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="h-[60px] bg-[#F9FAFB] rounded-b-2xl border-t border-[#E5E7EB] px-3 flex items-center gap-2">
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
              className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />

            {/* Send Button */}
            <button
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

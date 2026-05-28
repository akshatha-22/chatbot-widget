import { useState } from "react";
import { ChatbotLauncher } from "./components/ChatbotLauncher";
import { ChatWidget } from "./components/ChatWidget";
import { FullChatOverlay } from "./components/FullChatOverlay";

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFullOverlay, setIsFullOverlay] = useState(false);

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setIsFullOverlay(false);
  };

  const handleExpandToFull = () => {
    setIsChatOpen(false);
    setIsFullOverlay(true);
  };

  const handleMinimizeToWidget = () => {
    setIsFullOverlay(false);
    setIsChatOpen(true);
  };

  const handleCloseAll = () => {
    setIsChatOpen(false);
    setIsFullOverlay(false);
  };

  return (
    <div className="size-full bg-gray-100 flex items-center justify-center">
      {/* High-fidelity wireframe content area */}
      <div className="text-center">
        <h1 className="text-2xl text-gray-400 mb-2">Webpage Content Area</h1>
        <p className="text-gray-400">
          Click the Remi sphere to open the chat widget, then expand for full view
        </p>
      </div>

      {/* Floating Chatbot Launcher */}
      <ChatbotLauncher
        onClick={handleOpenChat}
        isOpen={isChatOpen || isFullOverlay}
      />

      {/* Chat Widget */}
      <ChatWidget
        isOpen={isChatOpen}
        onClose={handleCloseAll}
        onExpand={handleExpandToFull}
      />

      {/* Full Chat Overlay */}
      <FullChatOverlay
        isOpen={isFullOverlay}
        onClose={handleCloseAll}
        onMinimize={handleMinimizeToWidget}
      />
    </div>
  );
}
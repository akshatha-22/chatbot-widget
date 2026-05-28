import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

const expressions = [
  {
    leftEyebrow: "M8 12 Q10 10 12 12",
    rightEyebrow: "M20 12 Q22 10 24 12",
    leftEye: "M9 17 Q10 16 11 17",
    rightEye: "M21 17 Q22 16 23 17",
    mouth: "M12 24 Q16 27 20 24",
  },
  {
    leftEyebrow: "M8 11 Q10 9 12 11",
    rightEyebrow: "M20 11 Q22 9 24 11",
    leftEye: "M9 16 Q10 15 11 16",
    rightEye: "M21 16 Q22 15 23 16",
    mouth: "M12 25 Q16 29 20 25",
  },
  {
    leftEyebrow: "M8 13 Q10 11 12 13",
    rightEyebrow: "M20 13 Q22 11 24 13",
    leftEye: "M9 18 Q10 17 11 18",
    rightEye: "M21 18 Q22 17 23 18",
    mouth: "M12 23 Q16 26 20 23",
  },
  {
    leftEyebrow: "M8 10 Q10 12 12 10",
    rightEyebrow: "M20 10 Q22 12 24 10",
    leftEye: "M9 17 Q10 16 11 17",
    rightEye: "M21 17 Q22 16 23 17",
    mouth: "M12 26 Q16 30 20 26",
  },
];

interface ChatbotLauncherProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatbotLauncher({ onClick, isOpen }: ChatbotLauncherProps) {
  const [expressionIndex, setExpressionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setExpressionIndex((prev) => (prev + 1) % expressions.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentExpression = expressions[expressionIndex];

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 flex flex-col items-center gap-2 z-50"
        >
          {/* Pulsing glow animation */}
          <motion.button
            onClick={onClick}
            className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-lg group overflow-visible"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b, #d97706)",
              boxShadow: "0 10px 25px rgba(251, 191, 36, 0.4)",
            }}
          >
            {/* Pulsing glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                background: "radial-gradient(circle, #fbbf24, #f59e0b)",
                filter: "blur(8px)",
              }}
            />

            {/* Enhanced shadow on hover */}
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                boxShadow: "0 20px 40px rgba(251, 191, 36, 0.6)",
              }}
            />

            {/* Face */}
            <svg
              viewBox="0 0 32 32"
              className="w-10 h-10 relative z-10"
              style={{ overflow: "visible" }}
            >
              <AnimatePresence mode="wait">
                <motion.g
                  key={expressionIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.path
                    d={currentExpression.leftEyebrow}
                    stroke="#ea580c"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    animate={{ d: currentExpression.leftEyebrow }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.path
                    d={currentExpression.rightEyebrow}
                    stroke="#ea580c"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    animate={{ d: currentExpression.rightEyebrow }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.circle
                    cx="10"
                    cy="17"
                    r="1.5"
                    fill="#ea580c"
                    animate={{ cy: currentExpression.leftEye.includes("16") ? 16 : currentExpression.leftEye.includes("18") ? 18 : 17 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.circle
                    cx="22"
                    cy="17"
                    r="1.5"
                    fill="#ea580c"
                    animate={{ cy: currentExpression.rightEye.includes("16") ? 16 : currentExpression.rightEye.includes("18") ? 18 : 17 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.path
                    d={currentExpression.mouth}
                    stroke="#ea580c"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    animate={{ d: currentExpression.mouth }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.g>
              </AnimatePresence>
            </svg>
          </motion.button>

          {/* Label */}
          <span className="text-sm font-medium text-gray-700">Remi</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

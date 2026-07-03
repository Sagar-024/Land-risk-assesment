"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Leaf } from "lucide-react";
type LeafProps = {
  id: string;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  size: number;
  duration: number;
  delay: number;
  initialRotation: number;
  endRotation: number;
};

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

function LeafLayer() {
  const [leaves, setLeaves] = useState<LeafProps[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    // We do an initial spawn immediately so the user sees atmosphere on load.
    spawnLeaves(true);

    // Then spawn every 15 seconds.
    const interval = setInterval(() => spawnLeaves(false), 15000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  function spawnLeaves(isInitial = false) {
    const count = Math.floor(randomRange(2, 5));
    const newLeaves: LeafProps[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const startY = randomRange(0, 100);
      newLeaves.push({
        id: `leaf-${timestamp}-${i}`,
        startX: isInitial ? randomRange(20, 90) : randomRange(100, 120), 
        endX: randomRange(-40, -10),
        startY: startY,
        endY: startY + randomRange(-10, 40),
        size: randomRange(16, 32),
        duration: randomRange(25, 45),
        delay: isInitial ? randomRange(0, 2) : randomRange(0, 10),
        initialRotation: randomRange(0, 360),
        endRotation: randomRange(-360, 720),
      });
    }

    setLeaves((prev) => [...prev, ...newLeaves]);
  }

  function handleLeafComplete(id: string) {
    // Remove the leaf from the DOM after it finishes falling to prevent memory bloat
    setLeaves((prev) => prev.filter((leaf) => leaf.id !== id));
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      <AnimatePresence>
        {leaves.map((leaf) => (
          <motion.div
            key={leaf.id}
            initial={{
              y: `${leaf.startY}vh`,
              x: `${leaf.startX}vw`,
              rotate: leaf.initialRotation,
              opacity: 0,
            }}
            animate={{
              y: `${leaf.endY}vh`,
              x: `${leaf.endX}vw`,
              rotate: leaf.endRotation,
              opacity: randomRange(0.1, 0.25),
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: leaf.duration,
              delay: leaf.delay,
              ease: "linear",
              opacity: {
                duration: leaf.duration / 4,
                ease: "easeOut",
              },
            }}
            onAnimationComplete={() => handleLeafComplete(leaf.id)}
            className="absolute top-0 left-0 text-ink-secondary"
            style={{ width: leaf.size, height: leaf.size }}
          >
            <Leaf className="w-full h-full text-[#6b8e23]" fill="currentColor" strokeWidth={1} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function CloudLayer() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[0]">
      <motion.div
        initial={{ x: "-50vw", y: "-20vh" }}
        animate={{ x: "150vw", y: "10vh" }}
        transition={{
          duration: 90,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-0 w-[150vw] h-[150vh] opacity-30 mix-blend-multiply"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(200, 195, 185, 0.4) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <motion.div
        initial={{ x: "150vw", y: "30vh" }}
        animate={{ x: "-50vw", y: "0vh" }}
        transition={{
          duration: 120,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-0 w-[200vw] h-[150vh] opacity-20 mix-blend-multiply"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(180, 175, 165, 0.3) 0%, transparent 50%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden mix-blend-multiply opacity-80">
      <CloudLayer />
      <LeafLayer />
    </div>
  );
}

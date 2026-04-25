import React from 'react';
import { motion } from 'framer-motion';

export const HoverScale = ({ children, scale = 1.05 }) => (
  <motion.div
    whileHover={{ scale }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
  >
    {children}
  </motion.div>
);

export const FadeIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    {children}
  </motion.div>
);

export const LoadingDots = () => (
  <motion.div 
    className="flex space-x-1"
    initial="initial"
    animate="animate"
  >
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-2 h-2 bg-current rounded-full"
        variants={{
          initial: { opacity: 0.3 },
          animate: { opacity: 1 }
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          repeatType: "reverse",
          delay: i * 0.2
        }}
      />
    ))}
  </motion.div>
);

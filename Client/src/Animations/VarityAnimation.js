export const staggerContainer = (delay = 0.15) => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: delay,
    },
  },
});

export const fadeUpItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

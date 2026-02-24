import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

const Footer = () => {
  const ref = useRef(null);

  // Start off-screen to prevent flash on load
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);

  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 20 });

  const maskImage = useTransform(
    smoothX,
    (x) =>
      `linear-gradient(
    90deg,
    transparent ${x - 150}px,
    white ${x}px,
    transparent ${x + 150}px
  )`,
  );

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <footer
      ref={ref}
      onMouseMove={handleMouseMove}
      className="
        relative
        overflow-hidden
        bg-linear-to-br from-bgDark via-[#0f1426] to-bgDark
        border-t border-white/10
        text-white
      "
    >
      {/* Background Watermark Container */}
      <div className="absolute bottom-0 left-0 w-full h-[55%] pointer-events-none">
        {/* Base faint text */}
        <h1
          className="
            absolute
            bottom-[-3vw]
            left-0
            w-full
            flex
            justify-center
            font-extrabold
            tracking-tight
            text-white/[0.035]
            leading-none
            select-none
            text-[clamp(140px,24vw,500px)]
          "
        >
          <span className="block">Talk2Hire</span>
        </h1>

        {/* Glow layer */}
        <motion.h1
          style={{
            WebkitMaskImage: maskImage,
            maskImage,
          }}
          className="
            absolute
            bottom-[-3vw]
            left-0
            w-full
            flex
            justify-center
            font-extrabold
            tracking-tight
            text-white/40
            leading-none
            select-none
            text-[clamp(140px,24vw,500px)]
          "
        >
          <span className="block">Talk2Hire</span>
        </motion.h1>
      </div>

      {/* Ambient gradient glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_120%,rgba(155,92,255,0.15),transparent_55%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_-10%,rgba(99,102,241,0.12),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-10">
        {/* Top Section */}
        <div className="grid gap-10 md:grid-cols-3 items-start">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-white">
              Talk2Hire
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Secure AI-powered voice interviews designed to streamline hiring
              with intelligence, compliance, and scale.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm text-white/60">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Company
            </h4>
            <Link to="/about" className="hover:text-white transition-colors">
              About
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <Link to="/careers" className="hover:text-white transition-colors">
              Careers
            </Link>
          </div>

          <div className="flex flex-col gap-3 text-sm text-white/60">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Legal
            </h4>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/security" className="hover:text-white transition-colors">
              Security
            </Link>
          </div>
        </div>

        <div className="my-12 h-px w-full bg-white/10" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-white/50 md:flex-row">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="font-medium text-white">Talk2Hire</span>. All
            rights reserved.
          </p>

          <p className="text-white/40">
            A subsidiary of{" "}
            <a
              href="https://quantumhash.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/60 hover:text-white transition-colors"
            >
              QuantumHash Corporation
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

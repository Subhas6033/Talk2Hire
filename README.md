# 🎙️ AI Voice Interview Platform

An **AI-powered voice interview preparation platform** built with modern frontend technologies.  
This application helps users practice interviews, receive AI-driven feedback, explore features, pricing, testimonials, and manage authentication through a polished, production-grade UI.

---

## 🚀 Features

### 🧠 Talk2Hire Experience

- Voice-based AI mock interviews
- Adaptive interview flow
- Real-time feedback & scoring (UI-ready)
- Resume-aware question generation (future-ready)

### 🎨 Modern UI / UX

- Glassmorphism-inspired design
- Smooth page transitions
- Scroll-based reveal animations
- Fully responsive layout

### 🔐 Authentication

- Signup & Login flows
- Password visibility toggle
- Form validation with `react-hook-form`
- Ready for backend integration

### 🧩 Reusable Component System

- Card, Button, Input, FormField components
- Variant-based styling
- Motion-ready components

### 🏷️ Marketing & Conversion Sections

- Feature highlights
- Auto-sliding trusted companies
- Pricing plans
- Testimonials carousel
- Video hero preview

---

## 🛠 Tech Stack

### Frontend

- **ReactJS**
- **React Router v6**
- **Tailwind CSS**
- **Motion (Framer Motion compatible)**

### Forms & UI

- `react-hook-form`
- `lucide-react` icons

---

---

## 🎞 Animations Architecture

- Global page transitions handled in `App.jsx`
- Scroll-triggered animations using `whileInView`
- No duplicate animations per route

Example animation config:

```js
export const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: {
    duration: 0.4,
    ease: "easeOut",
  },
};
```

## 🧑‍💻 Author

```
Built with ❤️ using modern frontend best practices.
```

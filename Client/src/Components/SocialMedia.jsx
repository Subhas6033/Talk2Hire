import { useState } from "react";
import { Modal, Button } from "../Components"; // Assuming you have these components

// Predefined social media logos (you can add more or use SVGs)
const SOCIAL_LOGOS = {
  youtube:
    "https://upload.wikimedia.org/wikipedia/commons/4/42/YouTube_icon_%282013-2017%29.png",
  instagram:
    "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
  github:
    "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
};

const SocialMediaSection = () => {
  const [socials, setSocials] = useState([
    { name: "YouTube", key: "youtube", link: "https://youtube.com" },
    { name: "Instagram", key: "instagram", link: "https://instagram.com" },
  ]);

  const [isModalOpen, setModalOpen] = useState(false);
  const [newSocialName, setNewSocialName] = useState("");
  const [newSocialKey, setNewSocialKey] = useState("");
  const [newSocialLink, setNewSocialLink] = useState("");

  const handleAddSocial = () => {
    if (!newSocialName || !newSocialKey || !newSocialLink) return;

    setSocials([
      ...socials,
      { name: newSocialName, key: newSocialKey, link: newSocialLink },
    ]);

    // Reset form
    setNewSocialName("");
    setNewSocialKey("");
    setNewSocialLink("");
    setModalOpen(false);
  };

  return (
    <div className="p-6 rounded-2xl shadow-lg border border-white/10">
      <h3 className="text-white font-semibold mb-4">Social Media</h3>

      <div className="flex items-center gap-4 flex-wrap">
        {socials.map((social) => (
          <a
            key={social.key}
            href={social.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-purpleGlow transition">
              <img
                src={SOCIAL_LOGOS[social.key]}
                alt={social.name}
                className="w-6 h-6 object-contain"
              />
            </div>
          </a>
        ))}

        {/* Add social button */}
        <div
          onClick={() => setModalOpen(true)}
          className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white text-2xl cursor-pointer hover:bg-white/10 transition"
        >
          +
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Social Media"
        size="sm"
        footer={
          <Button variant="primary" onClick={handleAddSocial}>
            Add
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-1">
              Platform Name
            </label>
            <input
              type="text"
              className="w-full p-2 rounded-lg bg-[#111] text-white border border-white/20"
              value={newSocialName}
              onChange={(e) => setNewSocialName(e.target.value)}
              placeholder="e.g., Github"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">
              Key (for logo)
            </label>
            <input
              type="text"
              className="w-full p-2 rounded-lg bg-[#111] text-white border border-white/20"
              value={newSocialKey}
              onChange={(e) => setNewSocialKey(e.target.value.toLowerCase())}
              placeholder="e.g., github"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">
              Profile Link
            </label>
            <input
              type="text"
              className="w-full p-2 rounded-lg bg-[#111] text-white border border-white/20"
              value={newSocialLink}
              onChange={(e) => setNewSocialLink(e.target.value)}
              placeholder="https://github.com/username"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SocialMediaSection;

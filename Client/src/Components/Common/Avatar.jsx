import { Button } from "../index";
import { useAuth } from "../../Hooks/useAuthHook";
import { useDispatch } from "react-redux";
import { logoutUser } from "../../API/authApi";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Avatar = () => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const firstName = user.fullName.split(" ")[0];

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/");
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Avatar */}
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center
        bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-900
        backdrop-blur-md border border-white/10
        shadow-lg shadow-black/40 cursor-pointer"
      >
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.fullName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="text-zinc-100 font-bold text-lg">
            {firstName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Dropdown */}
      <div
        className={`absolute right-0 top-full mt-1 min-w-45
        rounded-xl bg-white shadow-xl border border-gray-100
        transition-all duration-200 origin-top-right
        ${
          open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{user.fullName}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>

        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          Profile
        </button>

        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Avatar;

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
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Avatar Button */}
      <Button
        variant="secondary"
        className="h-9 w-9 rounded-full flex items-center justify-center"
      >
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.fullName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <span className="px-3 py-1 rounded-full text-white font-bold text-sm">
            {firstName.charAt(0).toUpperCase()}
          </span>
        )}
      </Button>

      {/* Hover Menu */}
      <div
        className={`absolute right-0 mt-2 w-fit rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden transition-all duration-200 transform ${
          open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Menu Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{user.fullName}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>

        {/* Menu Items */}
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          Profile
        </button>

        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Avatar;

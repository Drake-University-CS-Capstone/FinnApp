import { useState } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-gray-900 text-white shadow-md z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="text-xl font-bold">
            Financial Capstone
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="hover:text-gray-300 transition">
              Home
            </Link>
            <Link to="/login" className="hover:text-gray-300 transition">
              Login
            </Link>
            <Link to="/other" className="hover:text-gray-300 transition">
              Other
            </Link>
          </div>

          
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 px-4 pb-4 space-y-2">
          <Link to="/" className="block hover:text-gray-300">
            Home
          </Link>
          <Link to="/login" className="block hover:text-gray-300">
            Login
          </Link>
          <Link to="/other" className="block hover:text-gray-300">
            Other
          </Link>
        </div>
      )}
    </nav>
  );
}
import { useState } from "react";

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
            <a href="/" className="hover:text-gray-300 transition">
              Home
            </a>
            <a href="/login" className="hover:text-gray-300 transition">
              Login
            </a>
            <a href="/other" className="hover:text-gray-300 transition">
              Other
            </a>
          </div>

          {/* Mobile Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="focus:outline-none"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 px-4 pb-4 space-y-2">
          <a href="/" className="block hover:text-gray-300">
            Home
          </a>
          <a href="/login" className="block hover:text-gray-300">
            Login
          </a>
          <a href="/other" className="block hover:text-gray-300">
            Other
          </a>
        </div>
      )}
    </nav>
  );
}
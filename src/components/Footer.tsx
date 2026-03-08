import React from 'react';

function Footer() {
  return (
    <footer className="bg-gray-800 p-4 text-white text-center text-sm">
      <div className="container mx-auto">
        <p>&copy; {new Date().getFullYear()} Nova Ops Dashboard. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;

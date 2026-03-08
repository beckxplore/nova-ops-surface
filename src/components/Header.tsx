import React from 'react';

function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-white">Nova Ops Dashboard</h1>
        {/* You can add navigation or user info here later */}
      </div>
    </header>
  );
}

export default Header;

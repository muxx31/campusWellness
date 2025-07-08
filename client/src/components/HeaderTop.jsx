import React from 'react';

const HeaderTop = () => {
  return (
    <nav className="bg-white text-black shadow-md py-4 px-6">
      <ul className="flex justify-between items-center">
        <li className="text-xl font-bold text-gray-800">🌿 CampusWell</li>
        <div className="flex space-x-6">
          <li className="cursor-pointer hover:text-blue-600">Home</li>
          <li className="cursor-pointer hover:text-red-500">Logout</li>
        </div>
      </ul>
    </nav>
  );
};

export default HeaderTop;

  

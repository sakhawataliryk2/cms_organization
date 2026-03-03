import React from "react";

const Timecards = () => {
  return (
   <div className="bg-white rounded border border-gray-300 p-6">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">Timecards</h3>

      {/* Assignment box */}
      <div className="border border-gray-300 p-4 rounded mb-4">
        <h4 className="text-lg font-semibold text-gray-700 mb-2">Assignment: </h4>
        <button
         
          className="bg-blue-500 text-white py-2 px-4 rounded"
        >
          Select Assignment
        </button>
      </div>

    </div>
  );
};
export default Timecards;
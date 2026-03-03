import React from "react";

const Information = () => {
  return (
    <div className="flex">
      {/* Left Sidebar */}
      <div className="w-1/3 p-4 bg-white border border-gray-300 rounded mr-4">
        <div className="text-xl font-semibold text-gray-700 mb-3">YOUR COMPANY</div>
        <div className="text-sm text-gray-600 mb-4">
          <div>YOUR NAME</div>
          <div className="text-xs">Designation: Director</div>
        </div>
        <div className="text-sm text-gray-600">
          <div>123 Main Street, Any City</div>
          <div>info@yourcompany.com</div>
          <div>+1-800-123-4567</div>
        </div>
      </div>

      {/* Right Content */}
      <div className="w-2/3 p-4 bg-white border border-gray-300 rounded">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">PTO Availability</h3>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2">PTO Availability Date</th>
              <th className="border border-gray-300 px-4 py-2">PTO Available</th>
              <th className="border border-gray-300 px-4 py-2">Total Hours Worked</th>
              <th className="border border-gray-300 px-4 py-2">Regular Hours</th>
              <th className="border border-gray-300 px-4 py-2">OT</th>
              <th className="border border-gray-300 px-4 py-2">Expenses PTO</th>
            </tr>
          </thead>
          <tbody>
            {/* Example data */}
            <tr>
              <td className="border border-gray-300 px-4 py-2">2023-12-01</td>
              <td className="border border-gray-300 px-4 py-2">8</td>
              <td className="border border-gray-300 px-4 py-2">40</td>
              <td className="border border-gray-300 px-4 py-2">40</td>
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">0</td>
            </tr>
          </tbody>
        </table>
        
      </div>
      <div className="mt-6 text-sm text-gray-600 ml-10">
          <h4 className="font-semibold">How to view Paystubs</h4>
          <p>Website: <a href="https://portal.pdf1.snb.com" className="text-blue-500">portal.pdf1.snb.com</a></p>
          <p>Username is your email address</p>
        </div>
    </div>
  );
};

export default Information;
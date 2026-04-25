import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CSVLink } from 'react-csv';
import { FileText, Download, Printer } from 'lucide-react';

const ReportExporter = ({ data, targetId, filename }) => {
  const exportPDF = async () => {
    const element = document.getElementById(targetId);
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${filename}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const csvData = data.map(item => ({
    ...item,
    // Format any complex objects if needed
  }));

  return (
    <div className="flex space-x-2">
      <button 
        onClick={exportPDF}
        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        <FileText className="w-4 h-4 mr-2" />
        PDF
      </button>
      
      <CSVLink
        data={csvData}
        filename={`${filename}.csv`}
        className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
      >
        <Download className="w-4 h-4 mr-2" />
        CSV
      </CSVLink>

      <button 
        onClick={handlePrint}
        className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
      >
        <Printer className="w-4 h-4 mr-2" />
        Print
      </button>
    </div>
  );
};

export default ReportExporter;

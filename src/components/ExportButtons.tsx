import { Download, FileText } from 'lucide-react'

interface ExportButtonsProps {
  onExportCSV: () => void
  onExportPDF: () => void
  disabled?: boolean
}

export default function ExportButtons({ onExportCSV, onExportPDF, disabled = false }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExportCSV}
        disabled={disabled}
        className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export to CSV"
      >
        <Download className="w-4 h-4 mr-2" />
        CSV
      </button>
      <button
        onClick={onExportPDF}
        disabled={disabled}
        className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export to PDF"
      >
        <FileText className="w-4 h-4 mr-2" />
        PDF
      </button>
    </div>
  )
}

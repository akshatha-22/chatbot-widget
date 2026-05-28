import React from 'react'

const FilePanel: React.FC = () => {
  return (
    <div className="p-4">
      <h3 className="font-semibold mb-3">Files</h3>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
        <p className="text-gray-500">Drag files here or click to upload</p>
      </div>
    </div>
  )
}

export default FilePanel

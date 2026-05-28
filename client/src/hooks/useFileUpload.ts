import { useState, useCallback } from 'react'

interface FileUploadState {
  files: File[]
  isUploading: boolean
  progress: number
  error: string | null
}

/**
 * useFileUpload Hook
 * Manages file upload state and operations
 */
export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    files: [],
    isUploading: false,
    progress: 0,
    error: null,
  })

  const addFiles = useCallback((newFiles: File[]) => {
    setState((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
      error: null,
    }))
  }, [])

  const removeFile = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }))
  }, [])

  const clearFiles = useCallback(() => {
    setState((prev) => ({
      ...prev,
      files: [],
      progress: 0,
    }))
  }, [])

  const setProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }))
  }, [])

  const setIsUploading = useCallback((uploading: boolean) => {
    setState((prev) => ({
      ...prev,
      isUploading: uploading,
    }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
    }))
  }, [])

  const uploadFiles = useCallback(async () => {
    try {
      setIsUploading(true)
      setError(null)

      // Simulate upload
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Here you would make the actual API call
      clearFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [clearFiles])

  return {
    ...state,
    addFiles,
    removeFile,
    clearFiles,
    setProgress,
    setIsUploading,
    setError,
    uploadFiles,
  }
}

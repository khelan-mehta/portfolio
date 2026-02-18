import express from 'express'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Always save as avatar-video with original extension
    const ext = path.extname(file.originalname)
    cb(null, `avatar-video${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  },
})

// Context file path
const contextFilePath = path.join(__dirname, '..', '..', 'uploads', 'ai-context.json')

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET || 'default-secret-change-me',
    { expiresIn: '24h' }
  )

  res.json({ token })
})

// POST /api/admin/upload-video (protected)
router.post('/upload-video', authMiddleware, upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' })
  }

  const videoUrl = `/uploads/${req.file.filename}`
  res.json({
    message: 'Video uploaded successfully',
    videoUrl,
    filename: req.file.filename,
  })
})

// GET /api/admin/context (protected)
router.get('/context', authMiddleware, (req, res) => {
  try {
    if (fs.existsSync(contextFilePath)) {
      const data = JSON.parse(fs.readFileSync(contextFilePath, 'utf-8'))
      res.json({ context: data.context || '' })
    } else {
      res.json({ context: '' })
    }
  } catch {
    res.json({ context: '' })
  }
})

// POST /api/admin/context (protected)
router.post('/context', authMiddleware, (req, res) => {
  const { context } = req.body

  const uploadDir = path.dirname(contextFilePath)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  fs.writeFileSync(contextFilePath, JSON.stringify({ context, updatedAt: new Date().toISOString() }))
  res.json({ message: 'Context saved successfully' })
})

export default router

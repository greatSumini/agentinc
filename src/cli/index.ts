#!/usr/bin/env node
import { startServer } from '../server/index.js'

const port = parseInt(process.env.PORT || '3847', 10)
startServer(port)

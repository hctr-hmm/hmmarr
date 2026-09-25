FROM node:24-alpine
ENV NODE_ENV=production HMMARR_HOST=0.0.0.0 HMMARR_PORT=3000
WORKDIR /app
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node backend/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]

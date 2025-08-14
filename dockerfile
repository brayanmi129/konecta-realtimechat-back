# Imagen base oficial de Node.js
FROM node:22-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia archivos de dependencias
COPY package*.json ./

# Instala solo dependencias de Node.js
RUN npm install

# Copia el resto del código de tu aplicación
COPY . .

# Expone el puerto que usará tu app
EXPOSE 4343

# Define variables de entorno si las necesitas
ENV PORT=4343

# Comando para iniciar la app
CMD ["npm", "run", "start"]

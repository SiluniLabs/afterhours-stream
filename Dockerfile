FROM nginx:alpine

COPY index.html styles.css config.js game.js /usr/share/nginx/html/

EXPOSE 80
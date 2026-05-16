FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js sw.js manifest.webmanifest /usr/share/nginx/html/
COPY icon.svg icon-192.png icon-512.png /usr/share/nginx/html/

EXPOSE 80

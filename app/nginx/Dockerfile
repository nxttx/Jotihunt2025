FROM nginx:1.25.0

# Copy nginx configuration file
COPY ./nginx.conf /etc/nginx/nginx.conf

#mkdir /etc/nginx/certs
RUN mkdir /etc/nginx/certs

#generate self-signed certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt -subj "/C=US/ST=Denial/L=Springfield/O=Dis/CN=api.foxels.nl"
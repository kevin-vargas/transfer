# Multi-Project Docker Setup

Nginx reverse proxy with subdomain routing for multiple Docker projects.

## Quick Start

```bash
# Add projects to projects.conf
echo "foo:3000" >> projects.conf

# Build and run
make run
```

Access at: `http://cp.localhost`, `http://foo.localhost`

## Commands

```bash
make run     # Generate config and start all services
make build   # Generate config and build images  
make clean   # Stop and remove containers
```

## Adding Projects

1. Create folder with Dockerfile: `foo/`
2. Add to `projects.conf`: `foo:3000` (or `foo` for port 8080)  
3. Run `make run`

## Configuration

Edit `projects.conf`:
```
cp:8080
foo:3000
api         # Uses port 8080
```

**Production**: `DOMAIN=yourdomain.com make run`
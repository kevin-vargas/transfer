# Multi-Project Docker Setup

Nginx reverse proxy with subdomain routing for multiple Docker projects.

## Quick Start

```bash
# Add projects to projects.conf
echo "api:3000" >> projects.conf

# Build and run
make run
```

Access at: `http://api.lvh.me`

## Commands

It’s necessary to be logged into the gemini cli console in order to use the risk analysis service, since it relies on the same host credentials.
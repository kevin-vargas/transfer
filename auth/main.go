package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Username     string
	Password     string
	Secret       string
	TokenTTL     time.Duration
	ListenAddr   string
	CookieDomain string
}

func loadConfig() *Config {
	ttlHours := os.Getenv("TOKEN_TTL_HOURS")
	if ttlHours == "" {
		ttlHours = "24"
	}

	hours, err := strconv.Atoi(ttlHours)
	if err != nil {
		log.Printf("Invalid TOKEN_TTL_HOURS, using default 24: %v", err)
		hours = 24
	}

	domain := getEnvOrDefault("DOMAIN", "localhost")
	cookieDomain := "." + domain // Add dot prefix for subdomain sharing
	
	return &Config{
		Username:     getEnvOrDefault("USERNAME", "admin"),
		Password:     getEnvOrDefault("PASSWORD", "password"),
		Secret:       getEnvOrDefault("SECRET", "change-me-in-production"),
		TokenTTL:     time.Duration(hours) * time.Hour,
		ListenAddr:   getEnvOrDefault("LISTEN_ADDR", ":8080"),
		CookieDomain: cookieDomain,
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) generateToken(username string) string {
	expiry := time.Now().Add(c.TokenTTL).Unix()
	payload := fmt.Sprintf("%s:%d", username, expiry)

	h := hmac.New(sha256.New, []byte(c.Secret))
	h.Write([]byte(payload))
	signature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	token := base64.URLEncoding.EncodeToString([]byte(payload + ":" + signature))
	return token
}

func (c *Config) validateToken(token string) (string, bool) {
	decoded, err := base64.URLEncoding.DecodeString(token)
	if err != nil {
		return "", false
	}

	parts := strings.Split(string(decoded), ":")
	if len(parts) != 3 {
		return "", false
	}

	username, expiryStr, signature := parts[0], parts[1], parts[2]
	payload := username + ":" + expiryStr

	h := hmac.New(sha256.New, []byte(c.Secret))
	h.Write([]byte(payload))
	expectedSig := base64.URLEncoding.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		return "", false
	}

	expiry, err := strconv.ParseInt(expiryStr, 10, 64)
	if err != nil || time.Now().Unix() > expiry {
		return "", false
	}

	return username, true
}

const loginPageHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Login - Dale Auth</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #282a36;
            color: #f8f8f2;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: #44475a;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            width: 100%;
            max-width: 400px;
            border: 1px solid #6272a4;
        }
        
        .logo {
            display: block;
            margin: 0 auto 30px;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            border: 4px solid #bd93f9;
            padding: 8px;
            background: #44475a;
            box-shadow: 0 0 20px rgba(189, 147, 249, 0.3);
        }
        
        .title {
            text-align: center;
            margin-bottom: 30px;
            font-size: 24px;
            font-weight: 600;
            color: #bd93f9;
            text-shadow: 0 0 10px rgba(189, 147, 249, 0.3);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #f8f8f2;
            font-size: 14px;
        }
        
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #6272a4;
            border-radius: 8px;
            background: #282a36;
            color: #f8f8f2;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        input[type="text"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: #bd93f9;
            box-shadow: 0 0 0 3px rgba(189, 147, 249, 0.2);
            background: #44475a;
        }
        
        input[type="text"]::placeholder, input[type="password"]::placeholder {
            color: #6272a4;
        }
        
        button {
            width: 100%;
            background: linear-gradient(135deg, #bd93f9, #ff79c6);
            color: #282a36;
            padding: 14px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(189, 147, 249, 0.4);
            background: linear-gradient(135deg, #ff79c6, #bd93f9);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        .error {
            background: #ff5555;
            color: #f8f8f2;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #ff5555;
            animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        
        .footer {
            text-align: center;
            margin-top: 20px;
            color: #6272a4;
            font-size: 12px;
        }
        
        @media (max-width: 480px) {
            .login-container {
                padding: 30px 20px;
            }
            
            .logo {
                width: 120px;
                height: 120px;
            }
            
            .title {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <img src="/static/auth.png" alt="Dale Auth Logo" class="logo">
        <h1 class="title">Dale Auth</h1>
        {{if .Error}}<div class="error">{{.Error}}</div>{{end}}
        <form method="POST">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter your password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
        <div class="footer">
            Powered by Dale Auth System
        </div>
    </div>
</body>
</html>`

func (c *Config) handleCheck(w http.ResponseWriter, r *http.Request) {
	// Try cookie first (browser flow)
	if cookie, err := r.Cookie("session"); err == nil {
		if username, valid := c.validateToken(cookie.Value); valid {
			w.Header().Set("X-User", username)
			w.WriteHeader(http.StatusOK)
			return
		}
	}
	
	// Try Authorization header (agent flow)
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		token := strings.TrimPrefix(auth, "Bearer ")
		if username, valid := c.validateToken(token); valid {
			w.Header().Set("X-User", username)
			w.WriteHeader(http.StatusOK)
			return
		}
	}
	
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}

func (c *Config) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		tmpl := template.Must(template.New("login").Parse(loginPageHTML))
		tmpl.Execute(w, map[string]string{"Error": ""})
		return
	}

	if r.Method == "POST" {
		r.ParseForm()
		username := r.FormValue("username")
		password := r.FormValue("password")

		if username == c.Username && password == c.Password {
			token := c.generateToken(username)

			http.SetCookie(w, &http.Cookie{
				Name:     "session",
				Value:    token,
				Path:     "/",
				Domain:   c.CookieDomain, // Dynamic domain for subdomain sharing
				HttpOnly: true,
				Secure:   false, // Set to true in production with HTTPS
				SameSite: http.SameSiteLaxMode,
			})

			redirect := r.URL.Query().Get("redirect")
			if redirect == "" {
				redirect = "/"
			}
			http.Redirect(w, r, redirect, http.StatusFound)
			return
		}

		tmpl := template.Must(template.New("login").Parse(loginPageHTML))
		tmpl.Execute(w, map[string]string{"Error": "Invalid username or password"})
		return
	}
}

func (c *Config) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		Domain:   c.CookieDomain, // Match the login cookie domain
		HttpOnly: true,
		Expires:  time.Unix(0, 0),
	})

	redirect := r.URL.Query().Get("redirect")
	if redirect == "" {
		redirect = "/"
	}
	http.Redirect(w, r, redirect, http.StatusFound)
}

func (c *Config) handleLogo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")
	http.ServeFile(w, r, "auth.png")
}

func (c *Config) handleOAuth2Token(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	r.ParseForm()
	clientID := r.FormValue("client_id")
	clientSecret := r.FormValue("client_secret")
	grantType := r.FormValue("grant_type")
	
	if grantType != "client_credentials" {
		http.Error(w, "unsupported_grant_type", http.StatusBadRequest)
		return
	}
	
	if clientID != c.Username || clientSecret != c.Password {
		http.Error(w, "invalid_client", http.StatusUnauthorized)
		return
	}
	
	token := c.generateToken("agent")
	
	response := map[string]interface{}{
		"access_token": token,
		"token_type":   "Bearer",
		"expires_in":   int(c.TokenTTL.Seconds()),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	config := loadConfig()

	log.Printf("Starting auth service on %s", config.ListenAddr)
	log.Printf("Token TTL: %v", config.TokenTTL)
	log.Printf("Cookie domain: %s", config.CookieDomain)

	http.HandleFunc("/check", config.handleCheck)
	http.HandleFunc("/auth/login", config.handleLogin)
	http.HandleFunc("/auth/logout", config.handleLogout)
	http.HandleFunc("/oauth2/token", config.handleOAuth2Token)
	http.HandleFunc("/static/auth.png", config.handleLogo)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "Auth service running")
	})

	log.Fatal(http.ListenAndServe(config.ListenAddr, nil))
}

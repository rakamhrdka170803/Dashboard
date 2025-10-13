package config

import (
	"fmt"
	"log"
	"os"
)

type Config struct {
	Env        string
	DBDSN      string
	JWTSecret  string
	JWTIssuer  string
	JWTExpiryH int // jam
}

func Load() *Config {
	cfg := &Config{
		Env:        get("APP_ENV", "dev"),
		DBDSN:      must("DB_DSN"), // contoh: postgres://user:pass@localhost:5432/bjb?sslmode=disable
		JWTSecret:  must("JWT_SECRET"),
		JWTIssuer:  get("JWT_ISSUER", "bjb-backoffice"),
		JWTExpiryH: getInt("JWT_EXP_HOURS", 24),
	}
	return cfg
}

func get(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
func must(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing required env: %s", k)
	}
	return v
}
func getInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		var x int
		_, _ = fmt.Sscanf(v, "%d", &x)
		if x != 0 {
			return x
		}
	}
	return def
}

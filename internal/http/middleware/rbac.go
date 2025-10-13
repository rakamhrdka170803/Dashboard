package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func RequireRoles(allowed ...string) gin.HandlerFunc {
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, a := range allowed {
		allowedSet[a] = struct{}{}
	}

	return func(c *gin.Context) {
		val, exists := c.Get("claims")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "no claims"})
			return
		}

		claims, ok := val.(jwt.MapClaims) // <- WAJIB jwt.MapClaims
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid claims type"})
			return
		}

		raw, ok := claims["roles"]
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "no roles"})
			return
		}

		switch rs := raw.(type) {
		case []interface{}:
			for _, r := range rs {
				if s, ok := r.(string); ok {
					if _, ok := allowedSet[s]; ok {
						c.Next()
						return
					}
				}
			}
		case []string:
			for _, s := range rs {
				if _, ok := allowedSet[s]; ok {
					c.Next()
					return
				}
			}
		case string:
			if _, ok := allowedSet[rs]; ok {
				c.Next()
				return
			}
		default:
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "roles malformed"})
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	}
}

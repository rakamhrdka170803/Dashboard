package handler

import (
	"net/http"

	"bjb-backoffice/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct{ auth *service.AuthService }

func NewAuthHandler(auth *service.AuthService) *AuthHandler { return &AuthHandler{auth: auth} }

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token, user, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":        user.ID,
			"uuid":      user.UUID,
			"name":      user.FullName,
			"email":     user.Email,
			"roles":     userRolesToStrings(user),
			"photo_url": user.PhotoURL, // ⬅️ penting agar Topbar bisa langsung render foto
		},
	})
}

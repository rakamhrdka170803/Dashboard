package repository

import (
	"time"

	"bjb-backoffice/internal/domain"

	"gorm.io/gorm"
)

type LatenessRepository interface {
	Create(l *domain.Lateness) error
	Delete(id uint) error
	List(agentID *uint, from, to *time.Time, page, size int) ([]domain.Lateness, int64, error)

	// Aggregasi: kembalikan pasangan (periode, total_menit)
	Aggregate(agentID *uint, from, to *time.Time, group string) ([]AggRow, error)
}

type AggRow struct {
	Period time.Time `gorm:"column:period"`
	Total  int64     `gorm:"column:total"`
}

type latenessRepository struct{ db *gorm.DB }

func NewLatenessRepository(db *gorm.DB) LatenessRepository { return &latenessRepository{db: db} }

func (r *latenessRepository) Create(l *domain.Lateness) error { return r.db.Create(l).Error }

func (r *latenessRepository) Delete(id uint) error { return r.db.Delete(&domain.Lateness{}, id).Error }

func (r *latenessRepository) List(agentID *uint, from, to *time.Time, page, size int) ([]domain.Lateness, int64, error) {
	var (
		items []domain.Lateness
		total int64
	)
	q := r.db.Model(&domain.Lateness{})
	if agentID != nil {
		q = q.Where("agent_id = ?", *agentID)
	}
	if from != nil {
		q = q.Where("date >= ?", from.Format("2006-01-02"))
	}
	if to != nil {
		q = q.Where("date < ?", to.Format("2006-01-02"))
	}

	q.Count(&total)
	err := q.Order("date DESC, id DESC").Limit(size).Offset((page - 1) * size).Find(&items).Error
	return items, total, err
}

func (r *latenessRepository) Aggregate(agentID *uint, from, to *time.Time, group string) ([]AggRow, error) {
	// Postgres: date_trunc untuk weekly/monthly; daily cukup date
	var rows []AggRow
	base := r.db.Table("latenesses") // gorm pluralization default: "latenesses"

	where := "1=1"
	args := []any{}
	if agentID != nil {
		where += " AND agent_id = ?"
		args = append(args, *agentID)
	}
	if from != nil {
		where += " AND date >= ?"
		args = append(args, from.Format("2006-01-02"))
	}
	if to != nil {
		where += " AND date < ?"
		args = append(args, to.Format("2006-01-02"))
	}

	switch group {
	case "day":
		// Period = date (00:00)
		sql := `
			SELECT date::timestamp AS period, SUM(minutes) AS total
			FROM latenesses
			WHERE ` + where + `
			GROUP BY date
			ORDER BY date ASC`
		if err := base.Raw(sql, args...).Scan(&rows).Error; err != nil {
			return nil, err
		}
	case "week":
		sql := `
			SELECT date_trunc('week', date)::timestamp AS period, SUM(minutes) AS total
			FROM latenesses
			WHERE ` + where + `
			GROUP BY date_trunc('week', date)
			ORDER BY date_trunc('week', date) ASC`
		if err := base.Raw(sql, args...).Scan(&rows).Error; err != nil {
			return nil, err
		}
	case "month":
		sql := `
			SELECT date_trunc('month', date)::timestamp AS period, SUM(minutes) AS total
			FROM latenesses
			WHERE ` + where + `
			GROUP BY date_trunc('month', date)
			ORDER BY date_trunc('month', date) ASC`
		if err := base.Raw(sql, args...).Scan(&rows).Error; err != nil {
			return nil, err
		}
	default:
		// jika group kosong/unknown, treat as day
		sql := `
			SELECT date::timestamp AS period, SUM(minutes) AS total
			FROM latenesses
			WHERE ` + where + `
			GROUP BY date
			ORDER BY date ASC`
		if err := base.Raw(sql, args...).Scan(&rows).Error; err != nil {
			return nil, err
		}
	}
	return rows, nil
}

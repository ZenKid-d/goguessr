//! The canonical location pool. The server keeps the coordinates (the "truth");
//! clients only ever receive `image_id` for a round.

use std::path::Path;

use serde::Deserialize;

use crate::rng;
use crate::scoring::LatLng;

#[derive(Debug, Clone, Deserialize)]
pub struct PoolLocation {
    pub id: String,
    pub lat: f64,
    pub lng: f64,
    #[serde(default)]
    pub country: String,
}

#[derive(Debug, Deserialize)]
struct PoolFile {
    locations: Vec<PoolLocation>,
}

/// One playable round: the image to show plus the hidden ground truth.
#[derive(Debug, Clone)]
pub struct RoundTruth {
    pub image_id: String,
    pub truth: LatLng,
    pub country: String,
}

#[derive(Debug, Clone, Default)]
pub struct Pool {
    locations: Vec<PoolLocation>,
}

impl Pool {
    /// Build a pool directly from locations (used by the server bootstrap and tests).
    pub fn from_locations(locations: Vec<PoolLocation>) -> Self {
        Self { locations }
    }

    /// Load a pool from a JSON file (same schema as `data/locations.json`).
    pub fn load(path: &Path) -> std::io::Result<Self> {
        let raw = std::fs::read_to_string(path)?;
        let file: PoolFile = serde_json::from_str(&raw)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        Ok(Self {
            locations: file.locations,
        })
    }

    pub fn len(&self) -> usize {
        self.locations.len()
    }

    pub fn is_empty(&self) -> bool {
        self.locations.is_empty()
    }

    /// Distinct countries present (for validating region filters).
    pub fn has_country(&self, country: &str) -> bool {
        self.locations.iter().any(|l| l.country == country)
    }

    /// Pick up to `n` random rounds, optionally restricted to one country.
    pub fn pick_rounds(&self, n: usize, region: Option<&str>) -> Vec<RoundTruth> {
        let mut indices: Vec<usize> = self
            .locations
            .iter()
            .enumerate()
            .filter(|(_, l)| region.is_none_or(|r| l.country == r))
            .map(|(i, _)| i)
            .collect();
        rng::shuffle(&mut indices);
        indices
            .into_iter()
            .take(n)
            .map(|i| {
                let l = &self.locations[i];
                RoundTruth {
                    image_id: l.id.clone(),
                    truth: LatLng::new(l.lat, l.lng),
                    country: l.country.clone(),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Pool {
        Pool {
            locations: vec![
                PoolLocation {
                    id: "a".into(),
                    lat: 1.0,
                    lng: 2.0,
                    country: "France".into(),
                },
                PoolLocation {
                    id: "b".into(),
                    lat: 3.0,
                    lng: 4.0,
                    country: "Japan".into(),
                },
                PoolLocation {
                    id: "c".into(),
                    lat: 5.0,
                    lng: 6.0,
                    country: "France".into(),
                },
            ],
        }
    }

    #[test]
    fn picks_requested_count() {
        assert_eq!(sample().pick_rounds(2, None).len(), 2);
    }

    #[test]
    fn region_filter_limits_pool() {
        let rounds = sample().pick_rounds(5, Some("France"));
        assert_eq!(rounds.len(), 2);
        assert!(rounds.iter().all(|r| r.country == "France"));
    }
}

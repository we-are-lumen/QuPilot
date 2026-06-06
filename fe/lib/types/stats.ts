export interface IPublicStatMetric {
  label: string;
  value: number;
  display_value: string;
}

export interface IPublicStats {
  agents_deployed: IPublicStatMetric;
  total_rewards_earned: IPublicStatMetric & {
    currency: 'SOL';
  };
  total_rewards_pooled: IPublicStatMetric & {
    currency: 'SOL';
  };
  slots_claimed: IPublicStatMetric & {
    ratio: number;
    claimed: number;
    total_slots: number;
  };
}

export interface IPublicStatsResponse {
  stats: IPublicStats;
}

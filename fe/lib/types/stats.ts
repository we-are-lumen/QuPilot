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
  success_rate: IPublicStatMetric & {
    ratio: number;
  };
}

export interface IPublicStatsResponse {
  stats: IPublicStats;
}

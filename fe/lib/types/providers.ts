export interface IPublicProvider {
  uuid: string;
  display_name: string;
  logo_url: string | null;
  created_at: string;
  spotlight: boolean;
}

export interface IProvidersResponse {
  providers: IPublicProvider[];
}

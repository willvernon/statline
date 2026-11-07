-- Grain: 1 row per team.
-- Silver: light clean + key filter. Extra logo URLs deferred.

with source as (
    select * from {{ source('raw', 'nfl_teams') }}
),

cleaned as (
    select
        team_abbr,
        team_name,
        team_id,
        team_nick,
        team_conf,
        team_division,
        team_color,
        team_color2,
        team_logo_espn,
        team_wordmark
    from source
    where team_abbr is not null
)

select * from cleaned

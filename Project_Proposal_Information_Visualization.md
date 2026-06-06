# TECHNISCHE UNIVERSITÄT WIEN
## 193.171: INFORMATION VISUALIZATION
### Project Proposal

**Authors:**
* Francisco García Barrada (ID: 12551603)
* Luka Premus (ID: 12552143)
* Andrija Stevic (ID: 12107748)

**Date:** April 22, 2026

---

## 1 Data understanding

This project investigates player performance data from professional men's football from 2017 until 2025 in the top 5 European leagues.

The motivation behind the project is the impact of the departure of a highly influential midfielder on team performance. In particular, the two seasons following Toni Kroos' departure from Real Madrid woke our interest. After his departure, Real Madrid experienced unusual results: the club did not win any of the three major trophies (domestic league, domestic cup, UEFA Champions League) in the two subsequent seasons (including 2025/2026). This is interesting to analyze, as it is not the expected performance for the club given its history. Similar trophyless periods for Real Madrid in recent history have only occurred in 2020/2021, 2009/2010, and 2005/2006. Therefore, two consecutive seasons without major titles is an interesting outlier.

By analyzing the data we want to establish the key characteristics of a player and identify players with the same qualities. Also, we aim to investigate in what statistics the best players in each league stand out and see if successful players across leagues have the same strengths.

This motivates two main questions:
* What are the differences in the top player archetypes across the top 5 European football leagues?
* Which current players exhibit similar statistical profiles as Toni Kross and could potentially replicate this role in modern tactical systems?

## 2 Data mining

The data intended to be used for this project consists of one CSV file obtained from Kaggle (see link), containing player performance statistics in the top 5 European leagues from 2017 until 2025. The dataset has originally been scrapped from FBref, a public source for football statistics.

## 3 Data cleaning

Since we only have one dataset only limited data cleaning is needed. The data apperas to not need much preprocessing.

There are about 85.000 missing values, which is about 2 percent of the data and cannot really be imputed. The most missing values are in efficiency metrics and concern low-minute players. Therefore, we will primarily exclude players with limited playing time, but also have to drop columns with a lot of missing values. Additionally irrelevant positions like goalkeepers could be excluded since they are not relevant for our analysis.

## 4 Data exploration

We will focus on understanding the structure of player performance data and identifying patterns in different playing styles for midfielders. To achieve this, dimensionality reduction (PCA) will be applied.

The resulting components of the PCA will be visualized in 2D space to observe groupings of players and similarities in playing styles. It is also planned to use clustering techniques to identify groups of players with similar statistical profiles.

The cleaning and analysis of the information will be implemented using Python (mainly with pandas and scikit-learn). The visualizations are intended to be realized in a webpage using D3.js for more interactivity.

## 5 Feature engineering

The most relevant attributes are grouped into these categories:
* Passing and creativity: Key passes, progressive passes, expected assists
* Defending: Tackles and interceptions
* Attacking: Goals, assits, expected goals
